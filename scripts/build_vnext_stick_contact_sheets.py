import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build_hand_sheet(input_dir, output, view):
    clips = ('ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot')
    columns = 5
    tile = 270
    label_width = 150
    sheet = Image.new('RGB', (label_width + columns * tile, len(clips) * tile), '#11151b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    small_font = ImageFont.load_default(size=11)
    for row, clip in enumerate(clips):
        sources = sorted(input_dir.glob(f'{clip}-{view}-frame-*.png'))
        if len(sources) != columns:
            raise RuntimeError(f'Expected {columns} {view} renders for {clip}, found {len(sources)}.')
        y = row * tile
        draw.text((16, y + 22), clip.upper(), fill='#dbe7f3', font=font)
        draw.text((16, y + 47), view.replace('-', ' '), fill='#6f879d', font=small_font)
        for column, source in enumerate(sources):
            image = Image.open(source).convert('RGB').resize((tile, tile), Image.Resampling.LANCZOS)
            sheet.paste(image, (label_width + column * tile, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def build_ball_sheet(input_dir, output):
    clips = ('receive', 'pass', 'shot')
    columns = 5
    tile_width = 300
    tile_height = 270
    label_width = 150
    sheet = Image.new('RGB', (label_width + columns * tile_width, len(clips) * tile_height), '#11151b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    small_font = ImageFont.load_default(size=11)
    for row, clip in enumerate(clips):
        sources = sorted(input_dir.glob(f'{clip}-ball-contact-frame-*.png'))
        if len(sources) != columns:
            raise RuntimeError(f'Expected {columns} ball-contact renders for {clip}, found {len(sources)}.')
        y = row * tile_height
        draw.text((16, y + 22), clip.upper(), fill='#dbe7f3', font=font)
        draw.text((16, y + 47), 'blade and ball', fill='#6f879d', font=small_font)
        for column, source in enumerate(sources):
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            sheet.paste(image, (label_width + column * tile_width, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    build_hand_sheet(input_dir, output_dir / 'contact-sheet-hands-three-quarter-2026-07-12.png', 'hands-three-quarter')
    build_hand_sheet(input_dir, output_dir / 'contact-sheet-hands-side-2026-07-12.png', 'hands-side')
    build_ball_sheet(input_dir, output_dir / 'contact-sheet-blade-ball-2026-07-12.png')


if __name__ == '__main__':
    main()
