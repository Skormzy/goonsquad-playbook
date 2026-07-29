import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--file-prefix', default='cmu-35-24')
    parser.add_argument('--title', default='CMU 35-24 RUN/JOG - CONVERTED SOURCE PROGRESSION')
    args = parser.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output = Path(args.output).resolve()
    sources = sorted(input_dir.glob(f'{args.file_prefix}-frame-*.png'))
    if len(sources) != 5:
        raise RuntimeError(f'Expected five CMU source renders, found {len(sources)}.')

    columns = 3
    rows = 2
    tile_width = 320
    tile_height = 240
    header_height = 54
    sheet = Image.new('RGB', (tile_width * columns, tile_height * rows + header_height), '#090d14')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    draw.text((18, 18), args.title, fill='#70e8ff', font=font)
    for index, source in enumerate(sources):
        image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
        x = (index % columns) * tile_width
        y = header_height + (index // columns) * tile_height
        sheet.paste(image, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


if __name__ == '__main__':
    main()
