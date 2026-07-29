import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size):
    return ImageFont.load_default(size=size)


def build_equipment_sheet(input_dir, output):
    variants = ('home', 'away')
    views = ('front', 'three-quarter', 'side', 'rear', 'mask-close', 'pads-close', 'broadcast')
    tile_width, tile_height, label_width = 180, 225, 120
    sheet = Image.new('RGB', (label_width + len(views) * tile_width, len(variants) * tile_height), '#10151b')
    draw = ImageDraw.Draw(sheet)
    for row, variant in enumerate(variants):
        y = row * tile_height
        draw.text((14, y + 24), variant.upper(), fill='#e2ebf3', font=font(16))
        for column, view in enumerate(views):
            source = input_dir / f'equipment-{variant}-{view}.png'
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            sheet.paste(image, (label_width + column * tile_width, y))
            draw.text((label_width + column * tile_width + 8, y + 8), view.replace('-', ' '), fill='#b8c8d6', font=font(11))
    sheet.save(output, optimize=True)


def build_motion_sheet(input_dir, output, view):
    clips = ('goalie-ready', 'goalie-shuffle', 'goalie-set', 'goalie-save-glove', 'goalie-save-blocker')
    columns = 5
    tile_width, tile_height, label_width = 210, 263, 170
    sheet = Image.new('RGB', (label_width + columns * tile_width, len(clips) * tile_height), '#10151b')
    draw = ImageDraw.Draw(sheet)
    for row, clip in enumerate(clips):
        y = row * tile_height
        draw.text((14, y + 24), clip.replace('goalie-', '').upper(), fill='#e2ebf3', font=font(15))
        draw.text((14, y + 50), view.replace('-', ' '), fill='#6f879d', font=font(11))
        sources = sorted(input_dir.glob(f'motion-{clip}-{view}-*.png'))
        if len(sources) != columns:
            raise RuntimeError(f'Expected {columns} {view} renders for {clip}, found {len(sources)}.')
        for column, source in enumerate(sources):
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            sheet.paste(image, (label_width + column * tile_width, y))
    sheet.save(output, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    build_equipment_sheet(input_dir, output_dir / 'contact-sheet-goalie-equipment-2026-07-12.png')
    for view in ('front', 'three-quarter'):
        build_motion_sheet(input_dir, output_dir / f'contact-sheet-goalie-motion-{view}-2026-07-12.png', view)


if __name__ == '__main__':
    main()
